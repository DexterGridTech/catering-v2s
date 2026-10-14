import {createRequestId, nowTimestampMs} from '@catering-v2s/kernel-base-contracts';
import {selectLastLocalInteraction, type ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import type {TerminalUpdateArtifact, UpdatePort} from '@catering-v2s/kernel-base-platform-ports';
import {terminalUpdateActions} from '../../slices/terminalUpdate';
import {createOwnerHttpClient} from './createOwnerHttpClient';
import {actualMatchesArtifact, createStatus, fullManifestFromGrant, nextArtifact} from '../../../foundations/updateDecisions';
import type {
  TerminalUpdateState,
  TerminalUpdateTask,
  TerminalUpdateContextFacts,
  UpdateNetworkSnapshotReader,
  UpdateTargetSourceProvider,
} from '../../../types/terminalUpdate';

type ArtifactContext = ActorExecutionContext;
type ArtifactRuleContext = Readonly<{facts: TerminalUpdateContextFacts; identity: string}> | null;
type ArtifactStatus = TerminalUpdateState['recentStatus'];
type ArtifactExecutorInput = Readonly<{
  actions: typeof terminalUpdateActions;
  port: UpdatePort;
  readState: (context: ArtifactContext) => TerminalUpdateState;
  writeTask: (context: ArtifactContext, task: TerminalUpdateTask | null, status: ArtifactStatus) => Promise<boolean>;
  readNetworkSnapshot?: UpdateNetworkSnapshotReader;
  sourceProvider?: UpdateTargetSourceProvider;
  currentRuleContext: (context: ArtifactContext, fixedTask?: boolean) => ArtifactRuleContext;
  logLifecycle: (
    context: ArtifactContext,
    event: string,
    data: Readonly<Record<string, string | number | boolean | null>>,
  ) => void;
  logLifecycleWarning: (
    context: ArtifactContext,
    event: string,
    data: Readonly<Record<string, string | number | boolean | null>>,
  ) => void;
  logLifecycleAtLevel: (
    context: ArtifactContext,
    input: Readonly<{
      event: string;
      data: Readonly<Record<string, string | number | boolean | null>>;
      level: 'info' | 'warn';
    }>,
  ) => void;
}>;

export const createTerminalUpdateArtifactExecutor = ({
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
}: ArtifactExecutorInput) => {
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

  const applyPreparedArtifact = async (
    context: ActorExecutionContext,
    task: TerminalUpdateTask,
    input: Readonly<{
      actionId: string;
      preparedId: string;
      kind: 'full' | 'hot';
      interactionRevision?: number;
      newlyPrepared?: boolean;
    }>,
  ) => {
    const actualBootId = readState(context).actualVersions?.bootId;
    if (typeof actualBootId !== 'string' || actualBootId.length === 0) {
      if (input.newlyPrepared === true) await port.releasePrepared({timeoutMs: 10_000, preparedId: input.preparedId});
      return Object.freeze({status: 'unknown', reason: 'ACTUAL_BOOT_ID_UNAVAILABLE'});
    }
    const applyingPhase = input.kind === 'full' ? ('applying-full' as const) : ('applying-hot' as const);
    const applying = Object.freeze({
      ...task,
      bootId: actualBootId,
      phase: applyingPhase,
      actionId: input.actionId,
      actionKind: input.kind,
      preparedId: input.preparedId,
    });
    if (!(await writeTask(context, applying, createStatus(task.taskId, 'applying', null)))) {
      if (input.newlyPrepared === true) await port.releasePrepared({timeoutMs: 10_000, preparedId: input.preparedId});
      await writeTask(
        context,
        task,
        createStatus(
          task.taskId,
          task.phase === 'waiting-idle' ? 'waiting-idle' : 'fixed',
          'PERSISTENCE_FAILED_BEFORE_APPLY',
        ),
      );
      return Object.freeze({status: 'persistence-failed', reason: 'PERSISTENCE_FAILED_BEFORE_APPLY'});
    }
    if (
      input.interactionRevision !== undefined &&
      selectLastLocalInteraction(context.getState()).revision !== input.interactionRevision
    ) {
      const waiting = Object.freeze({
        ...task,
        phase: 'waiting-idle' as const,
        actionId: input.actionId,
        actionKind: 'hot' as const,
      });
      await writeTask(context, waiting, createStatus(task.taskId, 'waiting-idle', null));
      return Object.freeze({status: 'waiting-idle', reason: 'LOCAL_INTERACTION_CHANGED'});
    }
    const applyStartedAt = Date.now();
    logLifecycle(context, 'artifact-apply-started', {
      taskId: task.taskId,
      actionId: input.actionId,
      artifactKind: input.kind,
    });
    let applied: Awaited<ReturnType<UpdatePort['applyPrepared']>>;
    try {
      applied = await port.applyPrepared({
        timeoutMs: input.kind === 'hot' ? 60_000 : 120_000,
        taskId: task.taskId,
        actionId: input.actionId,
        preparedId: input.preparedId,
        kind: input.kind,
      });
    } catch (error) {
      logLifecycleWarning(context, 'artifact-apply-threw', {
        taskId: task.taskId,
        actionId: input.actionId,
        artifactKind: input.kind,
        errorName: error instanceof Error ? error.name : 'UnknownError',
        elapsedMs: Math.max(0, Date.now() - applyStartedAt),
      });
      throw error;
    }
    logLifecycleAtLevel(context, {
      event: 'artifact-apply-returned',
      data: {
        taskId: task.taskId,
        actionId: input.actionId,
        artifactKind: input.kind,
        portStatus: applied.status,
        actionState: applied.status === 'succeeded' ? applied.value.state : null,
        errorCode: applied.status === 'failed' ? applied.error.code : null,
        elapsedMs: Math.max(0, Date.now() - applyStartedAt),
      },
      level: applied.status === 'failed' ? 'warn' : 'info',
    });
    if (applied.status !== 'succeeded') {
      const reason = applied.status === 'failed' ? applied.error.code : `APPLY_${applied.status.toUpperCase()}`;
      const state =
        applied.status === 'timed-out' || applied.status === 'unavailable' ? ('unknown' as const) : ('failed' as const);
      const failedTask = Object.freeze({...applying, phase: state, failureCode: reason});
      if (state === 'failed')
        recordFailedArtifact(
          context,
          task,
          (input.kind === 'full' ? task.target.full : task.target.hot)!.artifact.publicationId,
        );
      await writeTask(context, failedTask, createStatus(task.taskId, state, reason));
      return Object.freeze({status: state, reason});
    }
    const action = applied.value;
    if (action.taskId !== task.taskId || action.actionId !== input.actionId) {
      await writeTask(context, applying, createStatus(task.taskId, 'unknown', 'ACTION_IDENTITY_MISMATCH'));
      return Object.freeze({status: 'unknown', reason: 'ACTION_IDENTITY_MISMATCH'});
    }
    const artifact = input.kind === 'full' ? task.target.full : task.target.hot;
    if (artifact === null || action.publicationId !== artifact.artifact.publicationId) {
      await writeTask(context, applying, createStatus(task.taskId, 'unknown', 'ACTION_PUBLICATION_IDENTITY_MISMATCH'));
      return Object.freeze({status: 'unknown', reason: 'ACTION_PUBLICATION_IDENTITY_MISMATCH'});
    }
    if (action.state === 'failed') recordFailedArtifact(context, task, action.publicationId);
    const fullTerminal = input.kind === 'full' && (action.state === 'succeeded' || action.state === 'failed');
    if (action.state === 'succeeded' && input.kind === 'full' && task.target.hot !== null) {
      if (action.bootId === null) {
        const unknown = Object.freeze({
          ...applying,
          phase: 'unknown' as const,
          failureCode: 'ACTION_SUCCESS_BOOT_ID_UNAVAILABLE',
        });
        await writeTask(context, unknown, createStatus(task.taskId, 'unknown', 'ACTION_SUCCESS_BOOT_ID_UNAVAILABLE'));
        return Object.freeze({status: 'unknown', reason: 'ACTION_SUCCESS_BOOT_ID_UNAVAILABLE'});
      }
      if (!(await releaseUnreferencedFullArtifact(applying, action.publicationId))) {
        await writeTask(context, applying, createStatus(task.taskId, 'unknown', 'PREPARED_RELEASE_FAILED'));
        return Object.freeze({status: 'cleanup-failed', reason: 'PREPARED_RELEASE_FAILED'});
      }
      const fixed = Object.freeze({
        ...applying,
        phase: 'fixed' as const,
        actionId: null,
        actionKind: null,
        preparedId: null,
      });
      if (!(await writeTask(context, fixed, createStatus(task.taskId, 'fixed', null))))
        return Object.freeze({status: 'persistence-failed', reason: 'PERSISTENCE_FAILED_AFTER_FULL'});
      return Object.freeze({status: 'fixed', continuation: 'PRIMARY_READY'});
    }
    if (action.state === 'succeeded') {
      const actualReadStartedAt = Date.now();
      const actualRead = await port.readFacts({timeoutMs: 10_000});
      const actual = actualRead.status === 'succeeded' ? actualRead.value.actual : null;
      const actualMatches = actualMatchesArtifact(actual, artifact.artifact);
      const actualReadFailureReason = actualMatches
        ? null
        : actualRead.status !== 'succeeded' || actual === null
          ? 'ACTUAL_FACTS_UNAVAILABLE'
          : 'ACTION_SUCCESS_ACTUAL_VERSION_MISMATCH';
      logLifecycleAtLevel(context, {
        event: 'artifact-success-actual-readback',
        data: {
          taskId: task.taskId,
          actionId: input.actionId,
          artifactKind: input.kind,
          portStatus: actualRead.status,
          actualPresent: actual !== null,
          identityMatches: actualMatches,
          reasonCode: actualReadFailureReason,
          expectedApplicationId: artifact.artifact.applicationId,
          actualApplicationId: actual?.applicationId ?? null,
          expectedNativeVersion: artifact.artifact.nativeVersion,
          actualNativeVersion: actual?.nativeVersion ?? null,
          expectedNativeBuildNumber: artifact.artifact.nativeBuildNumber,
          actualNativeBuildNumber: actual?.nativeBuildNumber ?? null,
          expectedBundleVersion: artifact.artifact.bundleVersion,
          actualBundleVersion: actual?.bundleVersion ?? null,
          expectedRuntimeVersion: artifact.artifact.runtimeVersion,
          actualRuntimeVersion: actual?.runtimeVersion ?? null,
          expectedPublicationId: artifact.artifact.publicationId,
          actualPublicationId: actual?.publicationId ?? null,
          actualEntryKind: actual?.entryKind ?? null,
          elapsedMs: Math.max(0, Date.now() - actualReadStartedAt),
        },
        level: actualMatches ? 'info' : 'warn',
      });
      if (actualRead.status === 'succeeded') context.dispatchAction(actions.replaceActualVersions(actual));
      if (actualReadFailureReason !== null) {
        const unknown = Object.freeze({...applying, phase: 'unknown' as const, failureCode: actualReadFailureReason});
        if (!(await writeTask(context, unknown, createStatus(task.taskId, 'unknown', actualReadFailureReason))))
          return Object.freeze({status: 'persistence-failed', reason: 'PERSISTENCE_FAILED_AFTER_ACTUAL_FACTS'});
        return Object.freeze({status: 'unknown', reason: actualReadFailureReason});
      }
    }
    if (fullTerminal && !(await releaseUnreferencedFullArtifact(applying, action.publicationId))) {
      await writeTask(context, applying, createStatus(task.taskId, 'unknown', 'PREPARED_RELEASE_FAILED'));
      return Object.freeze({status: 'cleanup-failed', reason: 'PREPARED_RELEASE_FAILED'});
    }
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
    const updated = Object.freeze({
      ...applying,
      phase,
      preparedId: fullTerminal ? null : input.preparedId,
      lastInviteAt:
        input.kind === 'full' && status === 'waiting-user' ? nowTimestampMs() : (applying.lastInviteAt ?? null),
      failureCode: status === 'failed' ? action.reason : null,
    });
    await writeTask(context, updated, createStatus(task.taskId, status, action.reason));
    return Object.freeze({status, actionId: action.actionId, reason: action.reason});
  };

  const executeNextArtifact = async (context: ActorExecutionContext, task: TerminalUpdateTask) => {
    const factsStartedAt = Date.now();
    let factsResult = await port.readFacts({timeoutMs: 10_000});
    logLifecycleAtLevel(context, {
      event: 'update-facts-read-returned',
      data: {
        taskId: task.taskId,
        portStatus: factsResult.status,
        actualPresent: factsResult.status === 'succeeded' && factsResult.value.actual !== null,
        embeddedPresent: factsResult.status === 'succeeded' && factsResult.value.embedded !== null,
        elapsedMs: Math.max(0, Date.now() - factsStartedAt),
      },
      level: factsResult.status === 'failed' ? 'warn' : 'info',
    });
    if (factsResult.status !== 'succeeded') {
      if (!(await writeTask(context, task, createStatus(task.taskId, 'unknown', 'ACTUAL_FACTS_UNAVAILABLE'))))
        return Object.freeze({status: 'persistence-failed', reason: 'PERSISTENCE_FAILED_AFTER_ACTUAL_FACTS'});
      return Object.freeze({status: 'unknown', reason: factsResult.status});
    }
    context.dispatchAction(actions.replaceActualVersions(factsResult.value.actual));
    let fixedTask = task;
    if (fixedTask.originalBundleVersion == null) {
      const snapshot = Object.freeze({
        ...fixedTask,
        originalBundleVersion: fixedTask.originalBundleVersion ?? factsResult.value.actual?.bundleVersion ?? null,
      });
      if (snapshot.originalBundleVersion === null) {
        if (
          !(await writeTask(
            context,
            snapshot,
            createStatus(task.taskId, 'unknown', 'ACTUAL_BUNDLE_VERSION_UNAVAILABLE'),
          ))
        )
          return Object.freeze({status: 'persistence-failed', reason: 'PERSISTENCE_FAILED_AFTER_ACTUAL_FACTS'});
        return Object.freeze({status: 'unknown', reason: 'ACTUAL_BUNDLE_VERSION_UNAVAILABLE'});
      }
      if (!(await writeTask(context, snapshot, createStatus(task.taskId, 'fixed', null))))
        return Object.freeze({status: 'persistence-failed', reason: 'PERSISTENCE_FAILED_BEFORE_SELECTION'});
      fixedTask = snapshot;
    }
    if (fixedTask.originalBundleVersion == null) {
      if (
        !(await writeTask(
          context,
          fixedTask,
          createStatus(task.taskId, 'unknown', 'ORIGINAL_BUNDLE_VERSION_UNAVAILABLE'),
        ))
      )
        return Object.freeze({status: 'persistence-failed', reason: 'PERSISTENCE_FAILED_AFTER_ACTUAL_FACTS'});
      return Object.freeze({status: 'unknown', reason: 'ORIGINAL_BUNDLE_VERSION_UNAVAILABLE'});
    }
    let selected: ReturnType<typeof nextArtifact>;
    try {
      selected = nextArtifact({
        target: fixedTask.target,
        actual: factsResult.value.actual,
        embedded: factsResult.value.embedded,
        originalBundleVersion: fixedTask.originalBundleVersion,
      });
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
    if (
      readNetworkSnapshot === undefined ||
      (selected.artifactRef === undefined && sourceProvider?.resolveSourcePath === undefined)
    ) {
      const reason = 'UPDATE_SOURCE_OR_NETWORK_UNAVAILABLE';
      const failedTask = Object.freeze({...fixedTask, phase: 'failed' as const, failureCode: reason});
      await writeTask(context, failedTask, createStatus(task.taskId, 'failed', reason));
      return Object.freeze({status: 'failed', reason});
    }
    const executionBootId = factsResult.value.actual?.bootId;
    if (typeof executionBootId !== 'string' || executionBootId.length === 0) {
      const reason = 'ACTUAL_BOOT_ID_UNAVAILABLE';
      const unknown = Object.freeze({...fixedTask, phase: 'unknown' as const, failureCode: reason});
      await writeTask(context, unknown, createStatus(task.taskId, 'unknown', reason));
      return Object.freeze({status: 'unknown', reason});
    }
    const actionId = createRequestId();
    const preparingPhase = selected.kind === 'full' ? ('preparing-full' as const) : ('preparing-hot' as const);
    const beforePrepare = Object.freeze({
      ...fixedTask,
      bootId: executionBootId,
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

    let sourcePath: string | null = null;
    let downloadGrant: string | undefined;
    let artifactForPrepare: TerminalUpdateArtifact | null = null;
    if (selected.artifactRef !== undefined) {
      const grantContext = currentRuleContext(context, true);
      if (grantContext === null) {
        const reason = 'UPDATE_CONTEXT_NOT_READY';
        logLifecycle(context, 'fixed-task-context-not-ready', {
          taskId: task.taskId,
          artifactKind: selected.kind,
          contextReady: false,
          reasonCode: reason,
        });
        if (!(await writeTask(context, fixedTask, createStatus(task.taskId, 'fixed', null))))
          return Object.freeze({status: 'persistence-failed', reason: 'FIXED_TASK_DEFER_PERSISTENCE_FAILED'});
        return Object.freeze({status: 'deferred', reason});
      }
      if (grantContext.identity !== task.target.selectionContext.contextIdentity) {
        const reason = 'DOWNLOAD_GRANT_CONTEXT_CHANGED';
        await writeTask(context, fixedTask, createStatus(task.taskId, 'fixed', reason));
        return Object.freeze({status: 'stale-context', reason});
      }
      const grantNetwork = readNetworkSnapshot(context.getState(), 'business');
      const grantStartedAt = Date.now();
      logLifecycle(context, 'download-grant-request-started', {
        taskId: task.taskId,
        actionId,
        artifactKind: selected.kind,
      });
      const result = await createOwnerHttpClient(context).issueTerminalUpdateArtifactDownloadGrant({
        pathParameters: {artifactRef: selected.artifactRef},
        queryParameters: {},
        headers: {},
      });
      const afterGrant = readState(context);
      const currentTask = afterGrant.currentTask;
      const stillOwnsPreparation =
        currentTask !== null &&
        currentTask.taskId === task.taskId &&
        currentTask.actionId === actionId &&
        currentTask.actionKind === selected.kind &&
        currentTask.phase === preparingPhase;
      if (!stillOwnsPreparation) return Object.freeze({status: 'stale-task'});
      const currentGrantContext = currentRuleContext(context, true);
      const currentGrantNetwork = readNetworkSnapshot(context.getState(), 'business');
      if (
        currentGrantContext?.identity !== grantContext.identity ||
        JSON.stringify(currentGrantNetwork) !== JSON.stringify(grantNetwork)
      ) {
        const reason = 'DOWNLOAD_GRANT_CONTEXT_CHANGED';
        const restored = Object.freeze({
          ...fixedTask,
          phase: 'fixed' as const,
          actionId: null,
          actionKind: null,
          preparedId: null,
        });
        if (!(await writeTask(context, restored, createStatus(task.taskId, 'fixed', reason))))
          return Object.freeze({status: 'persistence-failed', reason: 'DOWNLOAD_GRANT_CONTEXT_RESTORE_FAILED'});
        return Object.freeze({status: 'stale-context', reason});
      }
      logLifecycleAtLevel(context, {
        event: 'download-grant-request-returned',
        data: {
          taskId: task.taskId,
          actionId,
          artifactKind: selected.kind,
          resultKind: result?.kind ?? 'unavailable',
          errorCode:
            result?.kind === 'business-rejection' ? result.errorCode : result?.kind === 'failure' ? result.code : null,
          elapsedMs: Math.max(0, Date.now() - grantStartedAt),
        },
        level: result?.kind === 'success' ? 'info' : 'warn',
      });
      if (
        result?.kind !== 'success' ||
        result.body.artifactRef !== selected.artifactRef ||
        result.body.expiresAtEpochMillis <= Date.now() ||
        result.body.zipSha256 !== selected.expectedSha256
      ) {
        const reason = result?.kind === 'business-rejection' ? result.errorCode : 'DOWNLOAD_GRANT_UNAVAILABLE';
        const failedTask = Object.freeze({...beforePrepare, phase: 'failed' as const, failureCode: reason});
        await writeTask(context, failedTask, createStatus(task.taskId, 'failed', reason));
        return Object.freeze({status: 'failed', reason});
      }
      sourcePath = result.body.relativeContentPath;
      downloadGrant = result.body.grant;
      const expectedSource = selected.kind === 'full' ? fixedTask.target.full : fixedTask.target.hot;
      artifactForPrepare = fullManifestFromGrant({
        manifest: result.body.artifact,
        expected: expectedSource,
        expectedFull: fixedTask.target.full,
        requireMinimumFull: selected.kind === 'hot',
      });
      if (artifactForPrepare === null) {
        const reason = 'DOWNLOAD_ARTIFACT_IDENTITY_MISMATCH';
        const failedTask = Object.freeze({...beforePrepare, phase: 'failed' as const, failureCode: reason});
        await writeTask(context, failedTask, createStatus(task.taskId, 'failed', reason));
        return Object.freeze({status: 'failed', reason});
      }
    } else {
      sourcePath = await sourceProvider!.resolveSourcePath!(selected.sourceRef);
      const localArtifact = (selected.manifest ?? selected.artifact) as TerminalUpdateArtifact;
      if (
        !Array.isArray(localArtifact.files) ||
        localArtifact.files.length === 0 ||
        localArtifact.entry.length === 0 ||
        localArtifact.publicationId !== selected.artifact.publicationId
      ) {
        const reason = 'LOCAL_ARTIFACT_MANIFEST_INVALID';
        const failedTask = Object.freeze({...beforePrepare, phase: 'failed' as const, failureCode: reason});
        await writeTask(context, failedTask, createStatus(task.taskId, 'failed', reason));
        return Object.freeze({status: 'failed', reason});
      }
      artifactForPrepare = localArtifact;
    }
    if (sourcePath === null) {
      const reason = 'SOURCE_UNAVAILABLE';
      const failedTask = Object.freeze({...beforePrepare, phase: 'failed' as const, failureCode: reason});
      await writeTask(context, failedTask, createStatus(task.taskId, 'failed', reason));
      return Object.freeze({status: 'failed', reason});
    }
    const network = readNetworkSnapshot(context.getState(), 'business');
    const prepareStartedAt = Date.now();
    logLifecycle(context, 'artifact-prepare-started', {
      taskId: task.taskId,
      actionId,
      artifactKind: selected.kind,
      sourceKind: selected.artifactRef === undefined ? 'local' : 'remote',
    });
    let prepared: Awaited<ReturnType<UpdatePort['prepareArtifact']>>;
    try {
      prepared = await port.prepareArtifact({
        timeoutMs: 120_000,
        sourceRef: selected.sourceRef,
        expectedSha256: selected.expectedSha256,
        artifact: artifactForPrepare!,
        sourcePath,
        ...(downloadGrant === undefined ? {} : {downloadGrant}),
        network,
        kind: selected.kind,
      });
    } catch (error) {
      logLifecycleWarning(context, 'artifact-prepare-threw', {
        taskId: task.taskId,
        actionId,
        artifactKind: selected.kind,
        sourceKind: selected.artifactRef === undefined ? 'local' : 'remote',
        errorName: error instanceof Error ? error.name : 'UnknownError',
        elapsedMs: Math.max(0, Date.now() - prepareStartedAt),
      });
      throw error;
    }
    logLifecycleAtLevel(context, {
      event: 'artifact-prepare-returned',
      data: {
        taskId: task.taskId,
        actionId,
        artifactKind: selected.kind,
        sourceKind: selected.artifactRef === undefined ? 'local' : 'remote',
        portStatus: prepared.status,
        errorCode: prepared.status === 'failed' ? prepared.error.code : null,
        elapsedMs: Math.max(0, Date.now() - prepareStartedAt),
      },
      level: prepared.status === 'failed' ? 'warn' : 'info',
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

    const preparedTask = Object.freeze({...beforePrepare, preparedId: prepared.value.preparedId});
    if (selected.kind === 'hot' && fixedTask.target.policy.hotStrategy === 'IDLE') {
      const waiting = Object.freeze({...preparedTask, phase: 'waiting-idle' as const});
      if (!(await writeTask(context, waiting, createStatus(task.taskId, 'waiting-idle', null)))) {
        await port.releasePrepared({timeoutMs: 10_000, preparedId: prepared.value.preparedId});
        await writeTask(context, fixedTask, createStatus(task.taskId, 'fixed', 'PERSISTENCE_FAILED_BEFORE_IDLE_WAIT'));
        return Object.freeze({status: 'persistence-failed', reason: 'PERSISTENCE_FAILED_BEFORE_IDLE_WAIT'});
      }
      return Object.freeze({status: 'waiting-idle', taskId: task.taskId, actionId});
    }
    return applyPreparedArtifact(context, preparedTask, {
      actionId,
      preparedId: prepared.value.preparedId,
      kind: selected.kind,
      newlyPrepared: true,
    });
  };

  return Object.freeze({
    applyPreparedArtifact,
    recordFailedArtifact,
    releaseUnreferencedFullArtifact,
    executeNextArtifact,
  });
};

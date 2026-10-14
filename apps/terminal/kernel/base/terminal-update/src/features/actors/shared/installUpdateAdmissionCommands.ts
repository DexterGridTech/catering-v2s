import {onCommand, type ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import type {StateJsonValue} from '@catering-v2s/kernel-base-state';
import type {UpdatePort} from '@catering-v2s/kernel-base-platform-ports';
import {requestTerminalUpdateCommand} from '../../../declarations/commands';
import {terminalUpdateActions} from '../../slices/terminalUpdate';
import {createStatus, nextArtifact, validTarget} from '../../../foundations/updateDecisions';
import type {TerminalUpdateExecution} from './createTerminalUpdateExecution';
import type {
  FixedUpdateTarget,
  TerminalUpdateContextFacts,
  TerminalUpdateState,
  TerminalUpdateTask,
} from '../../../types/terminalUpdate';

type AdmissionContext = ActorExecutionContext;
type AdmissionServices = Readonly<{
  actions: typeof terminalUpdateActions;
  execution: TerminalUpdateExecution;
  port: UpdatePort;
  createProtocolUuid: () => string;
  readState: (context: AdmissionContext) => TerminalUpdateState;
  writeTask: (
    context: AdmissionContext,
    task: TerminalUpdateTask | null,
    status: TerminalUpdateState['recentStatus'],
  ) => Promise<boolean>;
  persist: (context: AdmissionContext) => Promise<boolean>;
  currentRuleContext: (
    context: AdmissionContext,
  ) => Readonly<{facts: TerminalUpdateContextFacts; identity: string}> | null;
  currentUpdateTargetBindingIdentity: (
    context: AdmissionContext,
  ) => Readonly<{identity: string; generation: number}> | null;
  readCurrentCandidate: (context: AdmissionContext, target: FixedUpdateTarget) => Promise<FixedUpdateTarget | null>;
  hasCurrentCandidateReader: boolean;
  reportAdmissionWarning: (
    context: AdmissionContext,
    event: string,
    data: Readonly<Record<string, string | number | boolean | null>>,
  ) => void;
  releaseUnreferencedFullArtifact: (task: TerminalUpdateTask, publicationId: string) => Promise<boolean>;
  executeNextArtifact: (context: AdmissionContext, task: TerminalUpdateTask) => Promise<StateJsonValue | void>;
  reconcile: (context: AdmissionContext, resumeFixedTask: boolean) => Promise<Readonly<{status: string}>>;
}>;

export const installUpdateAdmissionCommands = (services: AdmissionServices) => {
  const {
    actions,
    execution,
    port,
    readState,
    writeTask,
    persist,
    currentRuleContext,
    currentUpdateTargetBindingIdentity,
    releaseUnreferencedFullArtifact,
    executeNextArtifact,
    reconcile,
  } = services;
  return onCommand(requestTerminalUpdateCommand, async context => {
    const reportAdmissionRejection = async (target: FixedUpdateTarget, reason: string) => {
      services.reportAdmissionWarning(context, 'target-admission-rejected', {reasonCode: reason});
      const status = Object.freeze({
        ...createStatus(null, 'admission-rejected', reason),
        applicationId: target.applicationId,
        ruleRef: target.ruleRef,
        fullArtifactRef: target.full?.artifactRef ?? null,
        hotArtifactRef: target.hot?.artifactRef ?? null,
      });
      return (await writeTask(context, null, status))
        ? Object.freeze({status: 'rejected', reason})
        : Object.freeze({status: 'persistence-failed', reason: 'ADMISSION_REJECTION_REPORT_PERSISTENCE_FAILED'});
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
      return executeNextArtifact(context, ready);
    };
    const rawTarget = context.command.payload.target;
    if (rawTarget !== null && !validTarget(rawTarget))
      return Object.freeze({status: 'rejected', reason: 'TARGET_INVALID'});
    const target = rawTarget === null ? null : rawTarget;
    if (target === null) {
      const currentTask = readState(context).currentTask;
      if (currentTask !== null) {
        if (currentTask.phase === 'fixed' && currentTask.actionId === null) return reconcile(context, true);
        return Object.freeze({status: 'already-fixed'});
      }
      const observed = await reconcile(context, false);
      return Object.freeze({status: 'no-candidate', observation: observed.status});
    }
    const selectionContext = target.selectionContext;
    if (execution.targetCommitPending !== null) await execution.targetCommitPending;
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

    const readCurrentCandidate = () => services.readCurrentCandidate(context, target);
    const logTargetRevalidationFailure = (
      phase: 'before-facts' | 'before-commit' | 'context',
      currentTarget: FixedUpdateTarget | null,
      contextMatches?: Readonly<{identity: boolean; binding: boolean}>,
    ): void => {
      const same = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);
      const currentTargetValid = currentTarget !== null && validTarget(currentTarget);
      context.platformPorts.logger.warn({
        category: 'terminal.update.lifecycle',
        event: 'target-revalidation-rejected',
        message: 'The selected update target changed before it could be accepted',
        data: {
          phase,
          reasonCode: phase === 'context' ? 'TARGET_CONTEXT_MISMATCH' : 'TARGET_CHANGED',
          candidatePresent: currentTarget !== null,
          targetValid: currentTargetValid,
          targetMatches: currentTargetValid && same(currentTarget, target),
          ruleMatches: currentTargetValid && currentTarget.ruleRef === target.ruleRef,
          collectionMatches: currentTargetValid && currentTarget.collectionHash === target.collectionHash,
          applicationMatches: currentTargetValid && currentTarget.applicationId === target.applicationId,
          fullArtifactMatches: currentTargetValid && same(currentTarget.full, target.full),
          hotArtifactMatches: currentTargetValid && same(currentTarget.hot, target.hot),
          policyMatches: currentTargetValid && same(currentTarget.policy, target.policy),
          strategyMatches: currentTargetValid && same(currentTarget.strategy, target.strategy),
          selectionMatches: currentTargetValid && same(currentTarget.selectionContext, target.selectionContext),
          createdAtMatches: currentTargetValid && currentTarget.createdAt === target.createdAt,
          contextIdentityMatches: contextMatches?.identity ?? null,
          bindingIdentityMatches: contextMatches?.binding ?? null,
        },
      });
    };
    const initialTarget = await readCurrentCandidate();
    if (
      initialTarget === null ||
      !validTarget(initialTarget) ||
      JSON.stringify(initialTarget) !== JSON.stringify(target)
    ) {
      logTargetRevalidationFailure('before-facts', initialTarget);
      return Object.freeze({status: 'rejected', reason: 'TARGET_CHANGED'});
    }

    const actualIdentity = await port.readFacts({timeoutMs: 10_000});
    if (
      actualIdentity.status !== 'succeeded' ||
      typeof actualIdentity.value.actual?.applicationId !== 'string' ||
      actualIdentity.value.actual.applicationId.length === 0
    ) {
      context.platformPorts.logger.warn({
        category: 'terminal-update.rules',
        event: 'terminal-update.rules.target-identity-unavailable',
        message: 'Could not verify the current application identity before accepting an update target',
        data: {
          readStatus: actualIdentity.status,
          actualIdentityPresent:
            actualIdentity.status === 'succeeded' &&
            typeof actualIdentity.value.actual?.applicationId === 'string' &&
            actualIdentity.value.actual.applicationId.length > 0,
        },
      });
      return Object.freeze({status: 'unknown', reason: 'ACTUAL_IDENTITY_UNAVAILABLE'});
    }
    context.dispatchAction(actions.replaceActualVersions(actualIdentity.value.actual));
    const applicationMatches = target.applicationId === actualIdentity.value.actual.applicationId;
    context.platformPorts.logger.info({
      category: 'terminal-update.rules',
      event: 'terminal-update.rules.target-identity-checked',
      message: 'Compared the selected rule application with this application before fixing the target',
      data: {applicationMatches},
    });
    if (!applicationMatches) return reportAdmissionRejection(target, 'APPLICATION_ID_MISMATCH');
    let candidate: ReturnType<typeof nextArtifact>;
    try {
      const actual = actualIdentity.value.actual!;
      candidate = nextArtifact({
        target,
        actual,
        embedded: actualIdentity.value.embedded,
        originalBundleVersion: actual.bundleVersion,
      });
      if (candidate === null) return Object.freeze({status: 'no-update', reason: 'ALREADY_AT_TARGET'});
    } catch (error) {
      const reason = error instanceof Error ? error.message.replace(/^TERMINAL_UPDATE_/u, '') : 'TARGET_INVALID';
      if (
        reason === 'FULL_ONLY_VERSION_DOWNGRADE' ||
        reason === 'HOT_VERSION_DOWNGRADE' ||
        reason === 'FULL_RUNTIME_MISMATCH' ||
        reason === 'HOT_RUNTIME_MISMATCH' ||
        reason === 'FULL_IDENTITY_CONFLICT' ||
        reason === 'HOT_IDENTITY_CONFLICT'
      )
        return reportAdmissionRejection(target, reason);
      return Object.freeze({status: 'rejected', reason});
    }

    // Another root command may have fixed a target while the provider was awaited.
    // Serialize only this persistence commit, then re-read its authoritative result.
    if (execution.targetCommitPending !== null) await execution.targetCommitPending;
    const latestTask = readState(context).currentTask;
    if (latestTask !== null) {
      const sameTarget = JSON.stringify(latestTask.target) === JSON.stringify(target);
      return Object.freeze({
        status: sameTarget ? 'already-fixed' : 'rejected',
        reason: sameTarget ? null : 'IDENTITY_CONFLICT',
      });
    }

    // Reserve the existing narrow target-commit slot before the final async
    // eligibility read. A newer rule/context cannot be fixed while this
    // candidate is being revalidated.
    let finishTargetCommit!: () => void;
    const targetCommit = new Promise<void>(resolve => {
      finishTargetCommit = resolve;
    });
    execution.targetCommitPending = targetCommit;
    try {
      const latestTarget = await readCurrentCandidate();
      if (latestTarget === null) {
        logTargetRevalidationFailure('before-commit', latestTarget);
        return Object.freeze({status: 'rejected', reason: 'TARGET_CHANGED'});
      }
      if (!validTarget(latestTarget) || JSON.stringify(latestTarget) !== JSON.stringify(target)) {
        logTargetRevalidationFailure('before-commit', latestTarget);
        return Object.freeze({status: 'rejected', reason: 'TARGET_CHANGED'});
      }
      const currentContext = currentRuleContext(context);
      if (currentContext !== null) {
        const currentBinding = currentUpdateTargetBindingIdentity(context);
        const contextIdentityMatches = currentContext.identity === selectionContext.contextIdentity;
        const bindingIdentityMatches =
          currentBinding !== null &&
          currentBinding.identity === `${currentContext.facts.terminalRef}:${currentContext.facts.bindingGeneration}`;
        if (!contextIdentityMatches || !bindingIdentityMatches) {
          logTargetRevalidationFailure('context', latestTarget, {
            identity: contextIdentityMatches,
            binding: bindingIdentityMatches,
          });
          return Object.freeze({status: 'rejected', reason: 'TARGET_CHANGED'});
        }
      } else if (!services.hasCurrentCandidateReader) {
        logTargetRevalidationFailure('context', latestTarget, {identity: false, binding: false});
        return Object.freeze({status: 'rejected', reason: 'TARGET_CHANGED'});
      }

      // Do not persist a new fixed task when the actual next artifact is
      // already known to have failed. The execution-side check remains as a
      // guard for a recovered fixed task whose facts changed after commit.
      if (candidate !== null && readState(context).failedArtifactIds.includes(candidate.artifact.publicationId)) {
        context.platformPorts.logger.warn({
          category: 'terminal-update.rules',
          event: 'terminal-update.rules.failed-artifact-reentry-blocked',
          message: 'Rejected an update candidate whose publication already failed on this installation',
          data: {publicationId: candidate.artifact.publicationId},
        });
        return reportAdmissionRejection(target, 'FAILED_ARTIFACT_REENTRY_FORBIDDEN');
      }

      const taskId = services.createProtocolUuid();
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
      const beforeCommit = readState(context);
      context.dispatchAction(actions.replaceTask(task));
      context.dispatchAction(actions.replaceRecentStatus(createStatus(taskId, 'fixed', null)));
      if (!(await persist(context))) {
        context.dispatchAction(actions.replaceTask(beforeCommit.currentTask));
        context.dispatchAction(actions.replaceRecentStatus(beforeCommit.recentStatus));
        await persist(context);
        return Object.freeze({status: 'persistence-failed', taskId});
      }
      return executeNextArtifact(context, task);
    } finally {
      if (execution.targetCommitPending === targetCommit) execution.targetCommitPending = null;
      finishTargetCommit();
    }
  });
};

import {onCommand, primarySurfaceReadyCommand, type ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import type {StateJsonValue} from '@catering-v2s/kernel-base-state';
import type {UpdatePort} from '@catering-v2s/kernel-base-platform-ports';
import {updatePresentationChangedCommand, confirmTerminalUpdateBootCommand} from '../../../declarations/commands';
import type {TerminalUpdateExecution} from './createTerminalUpdateExecution';
import type {TerminalUpdateState} from '../../../types/terminalUpdate';

type BootContext = ActorExecutionContext;
type ReconcileResult = Readonly<{status: string; actionState?: string}>;
type InstallUpdateBootCommandsInput = Readonly<{
  execution: TerminalUpdateExecution;
  port: UpdatePort;
  readState: (context: BootContext) => TerminalUpdateState;
  reconcile: (context: BootContext, resumeFixedTask: boolean) => Promise<ReconcileResult>;
  confirmBoot: (
    context: BootContext,
    payload: Readonly<{bootToken: string; publicationId: string}>,
  ) => Promise<StateJsonValue | void>;
}>;

export const installUpdateBootCommands = ({
  execution,
  port,
  readState,
  reconcile,
  confirmBoot,
}: InstallUpdateBootCommandsInput) =>
  [
    onCommand(updatePresentationChangedCommand, async context => {
      const {runtimeIdentity, presentation} = context.command.payload;
      if (runtimeIdentity !== context.runtimeId) {
        context.platformPorts.logger.warn({
          category: 'terminal-update.presentation',
          event: 'terminal-update.presentation.stale-runtime-ignored',
          message: 'Ignored a presentation observation from another Runtime instance',
          data: {status: 'ignored'},
        });
        return Object.freeze({status: 'ignored', reason: 'runtime-identity-mismatch'});
      }
      if (presentation === execution.currentPresentation) return Object.freeze({status: 'unchanged', presentation});
      execution.currentPresentation = presentation;
      if (presentation === 'foreground') {
        const readback = await reconcile(context, false);
        const current = readState(context);
        const task = current.currentTask;
        if (
          readback.status === 'waiting-user' &&
          'actionState' in readback &&
          readback.actionState === 'waiting-user' &&
          execution.currentPresentation === 'foreground' &&
          task !== null &&
          task.actionKind === 'full' &&
          task.actionId !== null &&
          task.target.full !== null &&
          task.phase === 'waiting-user' &&
          current.actualVersions !== null
        ) {
          const resumed = await port.presentInstallerConfirmation({
            timeoutMs: 10_000,
            taskId: task.taskId,
            actionId: task.actionId,
            publicationId: task.target.full.artifact.publicationId,
            trigger: 'source-permission-return',
          });
          if (resumed.status !== 'succeeded' && resumed.status !== 'unavailable') {
            context.platformPorts.logger.warn({
              category: 'terminal-update.installer-confirmation',
              event: 'terminal-update.installer-confirmation.source-permission-return-incomplete',
              message: 'Source-permission return did not restore the exact pending installer confirmation',
              data: {
                taskId: task.taskId,
                actionIdPresent: true,
                status: resumed.status,
                code: resumed.status === 'failed' ? resumed.error.code : null,
              },
            });
          }
        }
      }
      return Object.freeze({status: 'updated', presentation});
    }),
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
    onCommand(confirmTerminalUpdateBootCommand, context => confirmBoot(context, context.command.payload)),
  ] as const;

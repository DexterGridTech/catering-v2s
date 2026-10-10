import {selectLastLocalInteraction, type RuntimeModule, type RuntimeModuleContext} from '@catering-v2s/kernel-base-runtime';
import type {UpdatePort} from '@catering-v2s/kernel-base-platform-ports';
import {runtimeModuleDependencyNames} from '../dependencies';
import {moduleKind, moduleName} from '../moduleName';
import {createTerminalUpdateActor} from '../features/actors/terminalUpdateActor';
import {
  requestTerminalUpdateCommand,
  clearTerminalUpdateReportContextCommand,
  confirmTerminalUpdateBootCommand,
  confirmTerminalUpdateInstallCommand,
  deferTerminalUpdateInstallCommand,
  reconcileTerminalUpdateCommand,
  terminalUpdateDeadlineCommand,
  updatePresentationChangedCommand,
} from '../features/commands/commands';
import {terminalUpdateRegistration} from '../features/slices/terminalUpdate';
import {
  selectTerminalUpdateActualVersions,
  selectTerminalUpdateInvitation,
  selectTerminalUpdateRecentStatus,
  selectTerminalUpdateTask,
} from '../selectors/selectors';
import type {
  UpdateNetworkSnapshotReader,
  TerminalUpdateContextFacts,
  CurrentUpdateTargetReader,
  UpdateTargetSourceProvider,
} from '../types/terminalUpdate';
import type {UpdatePresentation} from '@catering-v2s/kernel-base-platform-ports';

export const unavailableUpdateTargetSourceProvider: UpdateTargetSourceProvider = Object.freeze({
  readTarget: async () => null,
});

export const createTerminalUpdateModule = (
  input: Readonly<{
    port: UpdatePort;
    /** Platform RFC 4122 UUID source for persisted task IDs and TDC report identities. */
    createProtocolUuid: () => string;
    sourceProvider?: UpdateTargetSourceProvider;
    readNetworkSnapshot?: UpdateNetworkSnapshotReader;
    readTerminalUpdateContextFacts?: (state: ReturnType<RuntimeModuleContext['getState']>) => TerminalUpdateContextFacts | null;
    readCurrentTarget?: CurrentUpdateTargetReader;
  }>,
): RuntimeModule => {
  const actor = createTerminalUpdateActor({
    port: input.port,
    createProtocolUuid: input.createProtocolUuid,
    sourceProvider: input.sourceProvider,
    readTerminalUpdateContextFacts: input.readTerminalUpdateContextFacts,
    readCurrentTarget: input.readCurrentTarget,
    readNetworkSnapshot: input.readNetworkSnapshot,
  });
  const commandDefinitions = [
    requestTerminalUpdateCommand,
    clearTerminalUpdateReportContextCommand,
    confirmTerminalUpdateBootCommand,
    terminalUpdateDeadlineCommand,
    confirmTerminalUpdateInstallCommand,
    deferTerminalUpdateInstallCommand,
    reconcileTerminalUpdateCommand,
    updatePresentationChangedCommand,
  ] as const;
  return Object.freeze({
    moduleName,
    kind: moduleKind,
    dependencies: runtimeModuleDependencyNames.map(name => ({moduleName: name})),
    commands: commandDefinitions.map(command => ({name: command.commandName, visibility: command.visibility})),
    commandDefinitions,
    selectorDefinitions: [
      selectTerminalUpdateActualVersions,
      selectTerminalUpdateInvitation,
      selectTerminalUpdateTask,
      selectTerminalUpdateRecentStatus,
    ],
    actors: [{name: actor.actorName}],
    actorDefinitions: [actor],
    slices: [
      {name: terminalUpdateRegistration.name, persistIntent: 'owner-only' as const, resetIntent: 'retain' as const},
    ],
    stateSlices: [terminalUpdateRegistration],
    install: async (context: RuntimeModuleContext) => {
      let disposed = false;
      let initializedPresentation = false;
      let currentPresentation: UpdatePresentation = 'unknown';
      let presentationDispatch = Promise.resolve();
      let deadlineTimer: ReturnType<typeof setTimeout> | null = null;
      let deadlineGeneration = 0;
      const scheduleDeadline = () => {
        if (deadlineTimer !== null) clearTimeout(deadlineTimer);
        deadlineTimer = null;
        const generation = ++deadlineGeneration;
        if (disposed || currentPresentation !== 'foreground') return;
        const state = context.getState();
        const task = selectTerminalUpdateTask(state);
        const actual = selectTerminalUpdateActualVersions(state);
        if (task === null || actual === null || (task.phase === 'waiting-user' && task.bootId !== actual.bootId)) return;
        const interaction = selectLastLocalInteraction(state);
        let kind: 'hot-idle' | 'full-reminder' | null = null;
        let deadlineAt: number | null = null;
        if (
          task.phase === 'waiting-idle' &&
          task.actionKind === 'hot' &&
          task.actionId !== null &&
          task.preparedId !== null &&
          task.target.policy.hotStrategy === 'IDLE' &&
          task.target.policy.mSeconds !== null
        ) {
          kind = 'hot-idle';
          deadlineAt = interaction.lastClickAt + task.target.policy.mSeconds * 1000;
        } else if (
          task.phase === 'waiting-user' &&
          task.actionKind === 'full' &&
          task.actionId !== null &&
          task.preparedId !== null &&
          task.target.full !== null
        ) {
          const recent = selectTerminalUpdateRecentStatus(state);
          const lastInviteAt = task.lastInviteAt ??
            (recent.taskId === task.taskId && recent.state === 'waiting-user' ? recent.changedAt : null);
          if (lastInviteAt !== null) {
            kind = 'full-reminder';
            deadlineAt = lastInviteAt + task.target.policy.nSeconds * 1000;
          }
        }
        if (kind === null || deadlineAt === null) return;
        const payload = Object.freeze({
          taskId: task.taskId,
          bootId: actual.bootId,
          kind,
          interactionRevision: interaction.revision,
          deadlineAt,
          scheduleGeneration: generation,
        });
        deadlineTimer = setTimeout(() => {
          deadlineTimer = null;
          if (disposed || generation !== deadlineGeneration) return;
          void context.dispatchCommand(terminalUpdateDeadlineCommand, payload)
            .then(result => {
              if (result.status !== 'completed') {
                context.platformPorts.logger.warn({
                  category: 'terminal-update.deadline',
                  event: 'terminal-update.deadline.dispatch-incomplete',
                  message: 'The scheduled terminal update deadline did not complete',
                  data: {kind, status: result.status},
                });
              }
            })
            .catch(error => {
              context.platformPorts.logger.error({
                category: 'terminal-update.deadline',
                event: 'terminal-update.deadline.dispatch-failed',
                message: 'The scheduled terminal update deadline failed',
                data: {kind, errorName: error instanceof Error ? error.name : 'UnknownError'},
              });
            })
            .finally(scheduleDeadline);
        }, Math.max(0, deadlineAt - Date.now()));
      };
      const publishPresentation = (presentation: UpdatePresentation): Promise<void> => {
        if (disposed) return Promise.resolve();
        if (initializedPresentation && currentPresentation === presentation) return presentationDispatch;
        initializedPresentation = true;
        currentPresentation = presentation;
        presentationDispatch = presentationDispatch
          .then(async () => {
            if (disposed) return;
            const result = await context.dispatchCommand(
              updatePresentationChangedCommand,
              Object.freeze({runtimeIdentity: context.runtimeId, presentation}),
            );
            if (result.status !== 'completed') {
              context.platformPorts.logger.warn({
                category: 'terminal-update.presentation',
                event: 'terminal-update.presentation.dispatch-incomplete',
                message: 'Presentation observation command did not complete',
                data: {status: result.status},
              });
            }
            scheduleDeadline();
          })
          .catch(error => {
            context.platformPorts.logger.error({
              category: 'terminal-update.presentation',
              event: 'terminal-update.presentation.dispatch-failed',
              message: 'Presentation observation command failed',
              data: {errorName: error instanceof Error ? error.name : 'UnknownError'},
            });
          });
        return presentationDispatch;
      };
      const unsubscribePresentation = input.port.subscribePresentation(presentation => {
        void publishPresentation(presentation);
      });
      context.registerResource(() => {
        disposed = true;
        deadlineGeneration += 1;
        if (deadlineTimer !== null) clearTimeout(deadlineTimer);
        deadlineTimer = null;
        unsubscribePresentation();
      });
      const unsubscribeState = context.subscribeState(scheduleDeadline);
      context.registerResource(unsubscribeState);
      const presentation = await input.port.readPresentation({timeoutMs: 10_000});
      if (presentation.status === 'succeeded') {
        await publishPresentation(presentation.value);
      } else if (presentation.status !== 'unavailable') {
        context.platformPorts.logger.warn({
          category: 'terminal-update.presentation',
          event: 'terminal-update.presentation.read-failed',
          message: 'Could not read the initial application presentation state',
          data: {
            status: presentation.status,
            code: presentation.status === 'failed' ? presentation.error.code : null,
          },
        });
      }
      const result = await context.dispatchCommand(
        reconcileTerminalUpdateCommand,
        Object.freeze({resumeFixedTask: false}),
      );
      if (result.status !== 'completed')
        throw new Error(`Terminal update startup reconciliation failed: ${result.status}`);
      scheduleDeadline();
    },
    onApplicationReset: async (context: RuntimeModuleContext) => {
      const result = await context.dispatchCommand(clearTerminalUpdateReportContextCommand, Object.freeze({}));
      if (result.status !== 'completed') throw new Error(`Terminal update report reset failed: ${result.status}`);
    },
  });
};

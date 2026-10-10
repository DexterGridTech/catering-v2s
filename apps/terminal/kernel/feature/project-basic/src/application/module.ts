import {createRequestId} from '@catering-v2s/kernel-base-contracts';
import type {RuntimeModule, RuntimeModuleContext} from '@catering-v2s/kernel-base-runtime';
import {selectTerminalUpdateActualVersions, selectTerminalUpdateTask} from '@catering-v2s/kernel-base-terminal-update';
import {selectStoreBasicBinding} from '@catering-v2s/kernel-feature-store-basic';
import {runtimeModuleDependencyNames} from '../dependencies';
import {moduleKind, moduleName} from '../moduleName';
import {
  selectCommercialGroup,
  selectProject,
  selectProjectBasicTopicState,
  selectProjectTerminalUpdateCandidate,
  selectProjectTerminalUpdateContextFacts,
  selectProjectTerminalUpdateRules,
  selectRegion,
} from '../selectors/selectors';
import {createProjectBasicActors} from '../features/actors/actors';
import {
  initializeProjectBasicCommand,
  evaluateProjectTerminalUpdateCommand,
  refreshProjectBasicTopicCommand,
  refreshProjectTerminalUpdateRulesCommand,
} from '../features/commands/commands';
import {projectBasicStateRegistration} from '../features/slices/slice';

const commands = [initializeProjectBasicCommand, evaluateProjectTerminalUpdateCommand, refreshProjectBasicTopicCommand, refreshProjectTerminalUpdateRulesCommand] as const;

export const createProjectBasicModule = (): RuntimeModule => {
  const actors = createProjectBasicActors();
  return Object.freeze({
    moduleName,
    kind: moduleKind,
    dependencies: runtimeModuleDependencyNames.map(name => ({moduleName: name})),
    commands: commands.map(command => ({name: command.commandName, visibility: command.visibility})),
    commandDefinitions: commands,
    selectorDefinitions: [
      selectCommercialGroup,
      selectProject,
      selectProjectBasicTopicState,
      selectProjectTerminalUpdateCandidate,
      selectProjectTerminalUpdateContextFacts,
      selectProjectTerminalUpdateRules,
      selectRegion,
    ],
    actors: actors.map(actor => ({name: actor.actorName})),
    actorDefinitions: actors,
    slices: [{name: projectBasicStateRegistration.name, persistIntent: projectBasicStateRegistration.persistIntent}],
    stateSlices: [projectBasicStateRegistration],
    install: async (context: RuntimeModuleContext) => {
      let lastEvaluationKey: string | null = null;
      const evaluateWhenInputsChange = (): void => {
        const root = context.getState();
        const binding = selectStoreBasicBinding(root);
        const updateContextFacts = selectProjectTerminalUpdateContextFacts(root);
        const rules = selectProjectTerminalUpdateRules(root);
        const actual = selectTerminalUpdateActualVersions(root);
        const task = selectTerminalUpdateTask(root);
        const key = JSON.stringify([
          binding === null ? null : [binding.terminalRef, binding.bindingGeneration, binding.storeRef, binding.groupWorkspaceKey],
          updateContextFacts,
          rules.contextIdentity,
          rules.collectionHash,
          rules.status,
          actual === null ? null : [actual.applicationId, actual.nativeVersion, actual.nativeBuildNumber, actual.runtimeVersion, actual.bundleVersion, actual.publicationId],
          task === null ? null : [task.taskId, task.phase, task.bootId],
        ]);
        if (key === lastEvaluationKey) return;
        lastEvaluationKey = key;
        if (updateContextFacts === null || rules.status !== 'ready' || actual?.applicationId == null) return;
        void context.dispatchCommand(evaluateProjectTerminalUpdateCommand, Object.freeze({}), {requestId: createRequestId()})
          .catch(error => context.platformPorts.logger.error({
            category: 'terminal.project-basic.update',
            event: 'terminal.project-basic.update.evaluation-dispatch-failed',
            message: 'Could not dispatch project update candidate evaluation',
            data: {errorName: error instanceof Error ? error.name : 'UnknownError'},
          }));
      };
      const unsubscribe = context.subscribeState(evaluateWhenInputsChange);
      context.registerResource(unsubscribe);
      const result = await context.dispatchCommand(initializeProjectBasicCommand, Object.freeze({}), {requestId: createRequestId()});
      if (result.status !== 'completed') throw new Error(`Project basic initialization dispatch failed: ${result.status}`);
      evaluateWhenInputsChange();
    },
    onApplicationReset: async (context: RuntimeModuleContext) => {
      const result = await context.dispatchCommand(initializeProjectBasicCommand, Object.freeze({}), {requestId: createRequestId()});
      if (result.status !== 'completed') throw new Error(`Project basic initialization failed: ${result.status}`);
    },
  });
};

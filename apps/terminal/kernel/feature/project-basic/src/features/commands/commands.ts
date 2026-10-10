import {defineCommand} from '@catering-v2s/kernel-base-runtime';
import type {TerminalActivationSucceededPayload, TerminalTopicChangedPayload} from '@catering-v2s/kernel-base-terminal-data-client';
import {moduleName} from '../../moduleName';

export type ProjectBasicRefreshPayload = Readonly<{
  binding: TerminalActivationSucceededPayload;
  notification: TerminalTopicChangedPayload['notification'];
}>;

export const initializeProjectBasicCommand = defineCommand<Readonly<{}>>(moduleName, {
  name: 'initialize-project-basic', visibility: 'public', allowNoActor: false, allowReentry: false, defaultTarget: 'local',
});
export const refreshProjectBasicTopicCommand = defineCommand<ProjectBasicRefreshPayload>(moduleName, {
  name: 'refresh-project-basic-topic', visibility: 'public', allowNoActor: false, allowReentry: false, defaultTarget: 'local',
});
export const refreshProjectTerminalUpdateRulesCommand = defineCommand<Readonly<{}>>(moduleName, {
  name: 'refresh-project-terminal-update-rules', visibility: 'public', allowNoActor: false, allowReentry: false, defaultTarget: 'local',
});

export const evaluateProjectTerminalUpdateCommand = defineCommand<Readonly<{}>>(moduleName, {
  name: 'evaluate-project-terminal-update', visibility: 'internal', allowNoActor: false,
  allowReentry: false, defaultTarget: 'local',
});

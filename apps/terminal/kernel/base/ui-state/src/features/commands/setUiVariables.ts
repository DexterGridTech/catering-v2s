import type {StateJsonValue} from '@catering-v2s/kernel-base-state';
import {defineCommand} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../../moduleName';
import type {UiVariableWrite} from '../../types/variable';

type SetUiVariablesPayload = Readonly<{
  readonly entries: readonly UiVariableWrite<StateJsonValue>[];
}>;

export const setUiVariablesCommand = defineCommand<SetUiVariablesPayload>(moduleName, {
  name: 'set-ui-variables',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});

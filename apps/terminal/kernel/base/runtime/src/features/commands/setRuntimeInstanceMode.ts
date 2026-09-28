import {defineCommand} from '../../foundations/defineCommand';
import {moduleName} from '../../moduleName';
import type {SetRuntimeInstanceModePayload} from '../../types/role';

export const setRuntimeInstanceModeCommand = defineCommand<SetRuntimeInstanceModePayload>(moduleName, {
  name: 'set-instance-mode',
  visibility: 'internal',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});

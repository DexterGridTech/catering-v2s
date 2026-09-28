import {defineCommand} from '../../foundations/defineCommand';
import {moduleName} from '../../moduleName';

export type ResetRuntimeAfterSystemFailurePayload = Readonly<{}>;

export const resetRuntimeAfterSystemFailureCommand = defineCommand<ResetRuntimeAfterSystemFailurePayload>(moduleName, {
  name: 'reset-runtime-after-system-failure',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});

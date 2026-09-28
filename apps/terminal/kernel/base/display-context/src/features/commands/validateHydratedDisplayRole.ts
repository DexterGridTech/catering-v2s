import {defineCommand} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../../moduleName';

type ValidateHydratedDisplayRolePayload = Readonly<{}>;

export const validateHydratedDisplayRoleCommand = defineCommand<ValidateHydratedDisplayRolePayload>(moduleName, {
  name: 'validate-hydrated-display-role',
  visibility: 'internal',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});

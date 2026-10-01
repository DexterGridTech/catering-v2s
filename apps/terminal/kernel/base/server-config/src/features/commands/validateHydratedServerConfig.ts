import {defineCommand} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../../moduleName';

export type ValidateHydratedServerConfigPayload = Readonly<Record<string, never>>;

export const validateHydratedServerConfigCommand = defineCommand<ValidateHydratedServerConfigPayload>(moduleName, {
  name: 'validate-hydrated-config',
  visibility: 'internal',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});

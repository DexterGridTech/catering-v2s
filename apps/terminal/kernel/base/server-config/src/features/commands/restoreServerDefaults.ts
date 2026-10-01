import {defineCommand} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../../moduleName';

export type RestoreServerDefaultsPayload = Readonly<Record<string, never>>;

export const restoreServerDefaultsCommand = defineCommand<RestoreServerDefaultsPayload>(moduleName, {
  name: 'restore-defaults',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});

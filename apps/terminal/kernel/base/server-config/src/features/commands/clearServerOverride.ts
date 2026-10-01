import {defineCommand} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../../moduleName';

export type ClearServerOverridePayload = Readonly<{serverName: string}>;

export const clearServerOverrideCommand = defineCommand<ClearServerOverridePayload>(moduleName, {
  name: 'clear-server-override',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});

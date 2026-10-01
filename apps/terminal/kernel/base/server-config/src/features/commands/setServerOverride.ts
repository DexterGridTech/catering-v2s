import {defineCommand} from '@catering-v2s/kernel-base-runtime';
import type {SetServerOverridePayload} from '../../types/serverConfig';
import {moduleName} from '../../moduleName';

export const setServerOverrideCommand = defineCommand<SetServerOverridePayload>(moduleName, {
  name: 'set-server-override',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});

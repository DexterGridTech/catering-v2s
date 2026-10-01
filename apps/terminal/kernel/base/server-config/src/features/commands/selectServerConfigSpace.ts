import {defineCommand} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../../moduleName';

export type SelectServerConfigSpacePayload = Readonly<{spaceName: string}>;

export const selectServerConfigSpaceCommand = defineCommand<SelectServerConfigSpacePayload>(moduleName, {
  name: 'select-space',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});

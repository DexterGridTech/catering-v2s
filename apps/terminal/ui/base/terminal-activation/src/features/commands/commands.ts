import {defineCommand} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../../moduleName';

export const needToActivateTerminalCommand = defineCommand<Readonly<{}>>(moduleName, {
  name: 'need-to-activate-terminal',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});

import {defineCommand} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../../moduleName';
import type {PowerSource} from '../../types/display';

type PowerStatusChangedPayload = Readonly<{powerSource: PowerSource}>;

export const powerStatusChangedCommand = defineCommand<PowerStatusChangedPayload>(moduleName, {
  name: 'power-status-changed',
  visibility: 'internal',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});

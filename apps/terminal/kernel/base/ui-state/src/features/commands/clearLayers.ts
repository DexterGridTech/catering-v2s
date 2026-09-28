import type {DisplayMode} from '@catering-v2s/kernel-base-display-context';
import {defineCommand} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../../moduleName';

type ClearLayersPayload = Readonly<{
  readonly displayMode: DisplayMode;
}>;

export const clearLayersCommand = defineCommand<ClearLayersPayload>(moduleName, {
  name: 'clear-layers',
  visibility: 'public',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});
